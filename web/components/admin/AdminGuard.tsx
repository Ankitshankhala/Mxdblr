"use client";

import { useEffect, useState, ComponentType } from "react";
import { useRouter } from "next/navigation";

export default function AdminGuard<P extends object>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  function GuardedComponent(props: P) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
      const token = localStorage.getItem("adminToken");

      if (!token) {
        router.replace("/admin/login");
        setChecking(false);
        return;
      }

      // Client-side expiry check. Full cryptographic verification is done server-side
      // by middleware.ts on every request — this is only a UX guard to avoid rendering
      // protected content for a split-second before the server redirect fires.
      try {
        const [, payloadB64] = token.split(".");
        // JWT uses base64url encoding — convert to standard base64 before atob
        const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(json) as { exp?: number; type?: string };

        const isExpired = payload.exp !== undefined && payload.exp * 1000 < Date.now();
        const isAdminToken = payload.type === "admin";

        if (isExpired || !isAdminToken) {
          localStorage.removeItem("adminToken");
          document.cookie = "adminToken=; path=/; max-age=0";
          router.replace("/admin/login");
          setChecking(false);
          return;
        }

        setAuthorized(true);
      } catch {
        // Malformed token — clear and redirect
        localStorage.removeItem("adminToken");
        document.cookie = "adminToken=; path=/; max-age=0";
        router.replace("/admin/login");
      }

      setChecking(false);
    }, [router]);

    if (checking) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            color: "#6B6B7D",
            fontSize: 14,
          }}
        >
          Checking authentication...
        </div>
      );
    }

    if (!authorized) return null;

    return <WrappedComponent {...props} />;
  }

  GuardedComponent.displayName = `AdminGuard(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  return GuardedComponent;
}
