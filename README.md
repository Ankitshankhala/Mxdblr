# MXDBLR — B2B Wholesale Mobile Accessories Platform

Client: Bharat Ram Mali
Built by: Charu Solutions

---

## Architecture

```
mxdblr/
├── api/   — Express + Prisma backend (port 4000)
└── web/   — Next.js 15 frontend (port 3000)
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

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/auth/send-otp | Send OTP to mobile |
| POST | /api/auth/verify-otp | Verify OTP, returns JWT or newDealer flag |
| POST | /api/auth/register | Register new dealer |
| POST | /api/auth/admin/login | Admin login |
| GET | /api/products | List products (filterable) |
| GET | /api/products/:id | Single product by ID or SKU |
| GET | /api/categories | Full category tree |
| GET | /api/categories/:slug | Single category |
| POST | /api/notify-me | Subscribe to restock notification |
| GET | /api/geo/check | Geo restriction check |

### Dealer (JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/cart | Get cart |
| POST | /api/cart | Add/update cart item |
| DELETE | /api/cart/:productId | Remove cart item |
| DELETE | /api/cart | Clear cart |
| GET | /api/dealers/me | Get own profile |
| PUT | /api/dealers/me | Update own profile |
| GET | /api/dealers/me/inquiries | Get own inquiry history |
| POST | /api/inquiry | Submit WhatsApp inquiry |

### Admin (Admin JWT required)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | /api/admin/products | Product management |
| PATCH | /api/admin/products/:id/stock | Update stock status |
| GET | /api/admin/dealers | List all dealers |
| GET | /api/admin/dealers/:id | Dealer detail |
| PUT | /api/admin/dealers/:id/moderate | Moderate dealer |
| GET | /api/admin/inquiries | List all inquiries |
| PUT | /api/admin/inquiries/:id/status | Update inquiry status |
| GET | /api/admin/notify/subscriptions | List notification subs |
| POST | /api/admin/notify/trigger/:productId | Trigger restock notifications |
| GET/POST/DELETE | /api/admin/geo | Geo restriction management |

---

## Frontend Pages

| Route | Description |
|-------|-------------|
| / | Homepage with hero, categories, new arrivals, brands |
| /catalog | Product listing with filters and search |
| /product/[sku] | Product detail with attributes, stock badge, cart |
| /auth | OTP login (mobile input + 6-box OTP step) |
| /register | 3-step dealer registration form |
| /cart | Inquiry cart with WhatsApp message builder |

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
