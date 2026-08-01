# MXDBLR — B2B Wholesale Mobile Accessories Platform

Client: Bharat Ram Mali
Built by: Charu Solutions

---

## Architecture

```
mxdblr/
├── api/   — Express + Prisma backend (port 4000)
└── web/   — Next.js 16 frontend (port 3000)
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ database
- (Optional) MSG91 account for OTP/WhatsApp
- (Optional) Cloudinary account for images

---

## API Setup (api/)

### 1. Install dependencies
```bash
cd api
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Set up database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (development)
npm run db:push

# OR run migrations (production)
npm run db:migrate
```

### 4. Start development server
```bash
npm run dev
# API runs at http://localhost:4000
```

### 5. Create first admin user
```bash
# Connect to your PostgreSQL database and run:
INSERT INTO "AdminUser" (id, username, "passwordHash", role, "createdAt")
VALUES (gen_random_uuid()::text, 'admin', '<bcrypt_hash>', 'SUPER_ADMIN', now());

# Generate bcrypt hash with: node -e "const b=require('bcryptjs');b.hash('yourpassword',10).then(h=>console.log(h))"
```

---

## Frontend Setup (web/)

### 1. Install dependencies
```bash
cd web
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:4000/api
# NEXT_PUBLIC_WHATSAPP_NUMBER=91XXXXXXXXXX
```

### 3. Start development server
```bash
npm run dev
# Frontend runs at http://localhost:3000
```

### 4. Production build
```bash
npm run build
npm start
```

---

## API Endpoints

All responses use the envelope `{ success, data, pagination? }` (or
`{ success, message }`). Admin routes require an admin JWT **and** the noted RBAC
permission (enforced at mount + inside each router).

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/auth/send-otp | Send OTP to mobile |
| POST | /api/auth/verify-otp | Verify OTP → JWT or `newDealer` flag |
| POST | /api/auth/register | Register new dealer (OTP-verified) |
| POST | /api/auth/admin/login | Admin login (bcrypt) |
| GET | /api/products | List products (filter/sort/paginate) |
| GET | /api/products/brands | Distinct brand names |
| GET | /api/products/:id | Single product by ID or SKU |
| GET | /api/categories | Full category tree |
| GET | /api/categories/:slug | Single category |
| GET | /api/banners | Active homepage banners |
| GET | /api/brands | Brand model list |
| GET | /api/features | Product feature definitions |
| GET | /api/announcements | Marquee announcements |
| GET | /api/events | Events & activities |
| POST | /api/notify-me | Subscribe to restock notification |
| GET | /api/geo/check | Geo restriction check |

### Dealer (dealer JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cart | Get cart |
| POST | /api/cart | Add/update cart item (server MOQ + stock enforce) |
| DELETE | /api/cart/:productId | Remove cart item |
| DELETE | /api/cart | Clear cart |
| GET | /api/dealers/me | Get own profile |
| PUT | /api/dealers/me | Update own profile |
| GET | /api/dealers/me/inquiries | Own inquiry history |
| POST | /api/inquiry | Submit WhatsApp inquiry |

### Admin (admin JWT + RBAC permission)
| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /api/admin/me | (any admin) | Current admin + permissions |
| GET | /api/admin/permissions | — | Permission catalog |
| GET/POST | /api/admin/roles · PATCH/DELETE /roles/:id | MANAGE_ROLES | Role management |
| GET | /api/admin/audit-logs | MANAGE_ROLES/ADMINS | Recent role/user changes |
| GET/POST/PATCH/DELETE | /api/admin/users(/:id) | MANAGE_ADMINS | Staff/admin accounts |
| GET/POST/PUT/DELETE | /api/admin/products(/:id) | MANAGE_PRODUCTS/INVENTORY | Product CRUD |
| POST | /api/admin/products/csv-import | MANAGE_PRODUCTS | Bulk CSV import |
| GET | /api/admin/products/stock-summary | " | Low/out-of-stock summary |
| PATCH | /api/admin/products/:id/{stock,new-arrival,best-seller,active} | " | Flags/stock |
| PUT | /api/admin/products/:id/stock | " | Set stock |
| GET/POST/PUT/PATCH/DELETE | /api/admin/categories(/:id) | MANAGE_PRODUCTS | Categories (+ /bulk, /:id/products, /:id/toggle) |
| GET | /api/admin/dealers · /:id · /export · /filters/options | MANAGE_CUSTOMERS | Dealer list/detail/export |
| PUT | /api/admin/dealers/:id/moderate | " | Block/suspend (revokes sessions) |
| GET | /api/admin/inquiries (alias /orders) | CREATE/EDIT_ORDERS, VIEW_REPORTS | Inquiry list |
| PUT | /api/admin/inquiries/:id/status | EDIT_ORDERS | Update inquiry status |
| GET/POST | /api/admin/notify/{subscriptions,trigger/:productId,products-with-subs,history,broadcast} | MANAGE_CUSTOMERS | Restock/broadcast |
| GET/POST/DELETE | /api/admin/geo | SYSTEM_SETTINGS | Geo allow-list |
| GET/POST/PUT/DELETE | /api/admin/banners | MANAGE_PRODUCTS | Banners (+ /reorder/bulk) |
| GET/POST/PUT/DELETE | /api/admin/brands | MANAGE_PRODUCTS | Brands |
| GET/POST/PUT/DELETE | /api/admin/features | MANAGE_PRODUCTS | Product features (+ /library) |
| GET/POST/PUT/DELETE | /api/admin/announcements | MANAGE_PRODUCTS | Marquee |
| GET/POST/PUT/DELETE | /api/admin/events | MANAGE_PRODUCTS | Events (+ /reorder/bulk) |
| GET/PUT | /api/admin/settings · PUT /change-password | SYSTEM_SETTINGS | Non-secret config + admin password |
| POST | /api/admin/upload · /video | MANAGE_PRODUCTS | Image/video upload |

> Integration secrets (MSG91, Cloudinary) are read from **env vars only** — the
> Settings screen manages non-secret config, not credentials.

---

## Frontend Pages

| Route | Rendering | Description |
|-------|-----------|-------------|
| / | SSR + ISR | Homepage: hero, categories, best-sellers, new arrivals, brands, events |
| /catalog | SSR + ISR | Product listing — URL-driven filters/sort/pagination |
| /product/[sku] | SSR | Product detail: attributes, stock badge, cart, features |
| /auth | Client | OTP login (mobile + 6-box OTP) |
| /register | Client | 3-step dealer registration |
| /cart | Client | Inquiry cart + WhatsApp message builder |
| /account, /account/profile | Client | Dealer account + profile edit |
| /wishlist | Client | localStorage wishlist |
| /admin/* | Client (JWT-gated) | Full admin suite: products, dealers, orders, banners, brands, categories, features, events, announcements, geo, roles, staff, audit-logs, settings, notifications |

---

## Design System

| Token | Value |
|-------|-------|
| Navy (primary bg) | #1A1A2E |
| Orange (CTA/accent) | #F47920 |
| Warm White (page bg) | #F8F6F2 |
| WhatsApp Green | #25D366 |
| Indigo (brand chip) | #6366F1 |

---

## Key Decisions

- **No pricing on frontend**: Platform is inquiry-only — all WhatsApp-based pricing discussion
- **Prisma v7**: Uses adapter-based connection via `@prisma/adapter-pg`
- **OTP mock**: When `MSG91_AUTH_KEY` is empty, OTP logs to console in dev
- **Geo restriction**: Allows all in development; checks DB restrictions in production
- **Admin JWT separate**: Admin routes require `type: 'admin'` claim — dealer tokens rejected

---

## Ports

| Service | Port |
|---------|------|
| Next.js frontend | 3000 |
| Express API | 4000 |
| Prisma Studio | 5555 |
