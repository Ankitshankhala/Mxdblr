"use client";

/**
 * Admin shell layout — wraps every /admin page. Renders the sidebar navigation
 * and header; nav items are shown/hidden based on the signed-in admin's
 * permissions (fetched from GET /api/admin/me). Provides logout.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState, useCallback } from "react";
import { ToastProvider } from "@/components/admin/Toast";
import { AdminAuthProvider, useAdminAuth, Permission } from "@/lib/admin/auth";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    exact: true,
  },
  {
    href: "/admin/banners",
    label: "Hero Banners",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    href: "/admin/announcements",
    label: "Announcements",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="m3 11 18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    href: "/admin/brands",
    label: "Brands",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    href: "/admin/dealers",
    label: "Dealers",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="12" y2="17" />
      </svg>
    ),
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: "/admin/geo",
    label: "Geo Restrictions",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    href: "/admin/roles",
    label: "Roles & Permissions",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M15 9h3M15 13h3M7 16h10" />
      </svg>
    ),
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Log",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h6" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/products": "Products",
  "/admin/categories": "Categories",
  "/admin/brands": "Brands",
  "/admin/dealers": "Dealers",
  "/admin/orders": "Orders",
  "/admin/notifications": "Notifications",
  "/admin/geo": "Geo Restrictions",
  "/admin/roles": "Roles & Permissions",
  "/admin/staff": "Staff",
  "/admin/audit-logs": "Audit Log",
  "/admin/settings": "Settings",
  "/admin/banners": "Hero Banners",
  "/admin/announcements": "Announcements",
};

// Permission(s) required to see a nav item / access a route. A route requires the
// user to hold AT LEAST ONE of the listed permissions. Used for BOTH menu filtering
// and the route-level access gate. The API enforces the same rules server-side — this
// is the UX layer (hide menu items, block direct-URL access with a 403 screen).
const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  "/admin": ["VIEW_DASHBOARD"],
  "/admin/products": ["MANAGE_PRODUCTS", "MANAGE_INVENTORY"],
  "/admin/categories": ["MANAGE_PRODUCTS"],
  "/admin/brands": ["MANAGE_PRODUCTS"],
  "/admin/banners": ["MANAGE_PRODUCTS"],
  "/admin/announcements": ["MANAGE_PRODUCTS"],
  "/admin/dealers": ["MANAGE_CUSTOMERS"],
  "/admin/notifications": ["MANAGE_CUSTOMERS"],
  "/admin/orders": ["CREATE_ORDERS", "EDIT_ORDERS", "VIEW_REPORTS"],
  "/admin/geo": ["SYSTEM_SETTINGS"],
  "/admin/settings": ["SYSTEM_SETTINGS"],
  "/admin/roles": ["MANAGE_ROLES"],
  "/admin/staff": ["MANAGE_STAFF", "MANAGE_ADMINS"],
  "/admin/audit-logs": ["MANAGE_ROLES", "MANAGE_ADMINS"],
};

// Resolve the required permissions for a pathname via longest-prefix match, so nested
// routes (e.g. /admin/products/123) inherit their section's requirement.
function requiredPermissionsForPath(pathname: string): Permission[] | null {
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];
  let best: { len: number; perms: Permission[] } | null = null;
  for (const [route, perms] of Object.entries(ROUTE_PERMISSIONS)) {
    if (route === "/admin") continue; // exact-only; never a prefix for everything
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (!best || route.length > best.len) best = { len: route.length, perms };
    }
  }
  return best?.perms ?? null;
}

// Detects viewport width below breakpoint, SSR-safe (starts false, resolves after mount)
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < breakpoint);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

interface SidebarProps {
  isMobile: boolean;
  drawerOpen: boolean;
  onClose: () => void;
}

function AdminSidebar({ isMobile, drawerOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasAny, loading } = useAdminAuth();

  // Only show nav items the user is permitted to access (UX layer; API still enforces).
  const visibleItems = NAV_ITEMS.filter((item) => {
    const perms = ROUTE_PERMISSIONS[item.href];
    return !perms || hasAny(...perms);
  });

  function handleLogout() {
    localStorage.removeItem("adminToken");
    document.cookie = "adminToken=; path=/; max-age=0";
    router.push("/admin/login");
  }

  function isActive(item: { href: string; exact?: boolean }) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const mobileStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    // CSS min() keeps it at most 280px but respects 85vw on very small screens
    width: "min(280px, 85vw)",
    height: "100vh",
    zIndex: 50,
    transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    overflowY: "auto",
  };

  const desktopStyle: React.CSSProperties = {
    width: 220,
    minWidth: 220,
    position: "sticky",
    top: 0,
    height: "100vh",
    zIndex: 10,
    flexShrink: 0,
  };

  return (
    <aside
      style={{
        ...(isMobile ? mobileStyle : desktopStyle),
        background: "#1A1A2E",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo row — includes ✕ close button on mobile */}
      <div
        style={{
          padding: "24px 20px 20px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#F47920", letterSpacing: "-0.02em" }}>
            MXD® Admin
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#6B6B7D",
              marginTop: 2,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Control Panel
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: -2,
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div style={{ width: "calc(100% - 40px)", margin: "0 20px", height: 1, background: "#2C2C4A", flexShrink: 0 }} />

      {/* Nav links */}
      <nav
        style={{
          flex: 1,
          padding: "12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
        }}
      >
        {loading && (
          <div style={{ padding: "10px 12px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading menu…</div>
        )}
        {!loading && visibleItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && onClose()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? "#F47920" : "rgba(255,255,255,0.70)",
                background: active ? "rgba(244,121,32,0.10)" : "transparent",
                borderLeft: active ? "3px solid #F47920" : "3px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: "12px 12px 24px", flexShrink: 0 }}>
        <div style={{ height: 1, background: "#2C2C4A", marginBottom: 12 }} />
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 10px",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            width: "100%",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#FCE7E7";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}

interface TopBarProps {
  isMobile: boolean;
  onHamburgerClick: () => void;
}

function AdminTopBar({ isMobile, onHamburgerClick }: TopBarProps) {
  const pathname = usePathname();
  const [now, setNow] = useState("");

  useEffect(() => {
    function fmt() {
      setNow(
        new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
    fmt();
    const t = setInterval(fmt, 60000);
    return () => clearInterval(t);
  }, []);

  const title = PAGE_TITLES[pathname] ?? "Admin";

  return (
    <header
      style={{
        height: 56,
        background: "#fff",
        borderBottom: "1px solid #E8E4DE",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
        // Prevent the header itself from causing overflow
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Left: hamburger (mobile) + page title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={onHamburgerClick}
            aria-label="Open navigation"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#1A1A2E",
              padding: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              borderRadius: 6,
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#1A1A2E",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right: datetime (hidden on mobile to prevent overflow) + Admin badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {!isMobile && (
          <span style={{ fontSize: 12, color: "#6B6B7D", whiteSpace: "nowrap" }}>{now}</span>
        )}
        <span
          style={{
            background: "#F47920",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          Admin
        </span>
      </div>
    </header>
  );
}

function AccessDenied({ roleName }: { roleName: string | null }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 48, fontWeight: 900, color: "#E8E4DE", lineHeight: 1 }}>403</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1A2E", marginTop: 12 }}>Access Denied</div>
      <p style={{ fontSize: 13, color: "#6B6B7D", marginTop: 8, maxWidth: 360 }}>
        Your role{roleName ? ` (${roleName})` : ""} does not have permission to view this page.
        Contact a Super Admin if you believe this is a mistake.
      </p>
      <Link href="/admin" style={{ marginTop: 18, padding: "9px 18px", borderRadius: 8, background: "#F47920", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
        Back to Dashboard
      </Link>
    </div>
  );
}

// Blocks direct-URL access to pages the user lacks permission for (UX layer; the API
// enforces the same server-side). Renders a loader until permissions resolve.
function RouteGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, loading, hasAny } = useAdminAuth();
  const required = requiredPermissionsForPath(pathname);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "#6B6B7D", fontSize: 14 }}>
        Loading…
      </div>
    );
  }
  if (required && !hasAny(...required)) {
    return <AccessDenied roleName={me?.role?.name ?? null} />;
  }
  return <>{children}</>;
}

function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer whenever the route changes (nav link clicked)
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Body scroll lock while the mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isMobile && drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, drawerOpen]);

  const checkAuth = useCallback(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      router.replace("/admin/login");
      setChecking(false);
      return;
    }
    try {
      const [, payloadB64] = token.split(".");
      const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(json) as { exp?: number; type?: string };
      const isExpired = payload.exp !== undefined && payload.exp * 1000 < Date.now();
      if (isExpired || payload.type !== "admin") {
        localStorage.removeItem("adminToken");
        document.cookie = "adminToken=; path=/; max-age=0";
        router.replace("/admin/login");
        setChecking(false);
        return;
      }
      setAuthorized(true);
    } catch {
      localStorage.removeItem("adminToken");
      document.cookie = "adminToken=; path=/; max-age=0";
      router.replace("/admin/login");
    }
    setChecking(false);
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (checking) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#1A1A2E",
          color: "rgba(255,255,255,0.5)",
          fontSize: 14,
        }}
      >
        Authenticating...
      </div>
    );
  }

  if (!authorized) return null;

  return (
    // overflow: hidden on the shell prevents horizontal scroll from the sliding drawer
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8F6F2", overflow: "hidden" }}>

      {/* Dark overlay — mobile only, appears behind the open drawer */}
      {isMobile && drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            zIndex: 40,
            backdropFilter: "blur(1px)",
            WebkitBackdropFilter: "blur(1px)",
          }}
        />
      )}

      {/* Sidebar — always in DOM for smooth CSS transition; position changes by isMobile */}
      <AdminSidebar
        isMobile={isMobile}
        drawerOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Main content column — takes full width on mobile because sidebar is position:fixed */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          // Explicit width:100% ensures no leftover gap when sidebar exits flex flow on mobile
          width: "100%",
        }}
      >
        <AdminTopBar
          isMobile={isMobile}
          onHamburgerClick={() => setDrawerOpen(true)}
        />
        <main
          style={{
            flex: 1,
            padding: isMobile ? 12 : 24,
            overflow: "auto",
            // Prevent any child with a fixed width from pushing the viewport
            maxWidth: "100%",
          }}
        >
          <RouteGate>{children}</RouteGate>
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Login page: render with no shell — clean standalone auth screen
  if (pathname === "/admin/login") {
    return <ToastProvider>{children}</ToastProvider>;
  }

  // All other /admin/* routes: protected shell with auth gate + permission context
  return (
    <ToastProvider>
      <AdminAuthProvider>
        <ProtectedShell>{children}</ProtectedShell>
      </AdminAuthProvider>
    </ToastProvider>
  );
}
