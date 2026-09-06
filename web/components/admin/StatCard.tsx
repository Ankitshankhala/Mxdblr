"use client";

/**
 * StatCard — dashboard metric tile (label, value, icon, optional link). Used by
 * the admin dashboard to surface counts and alerts.
 */
import { ReactNode } from "react";
import Link from "next/link";

type StatCardProps = {
  icon: ReactNode;
  value: number | string;
  label: string;
  accent?: string;
  href?: string;
};

export default function StatCard({ icon, value, label, accent = "#1F1813", href }: StatCardProps) {
  const inner = (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E8E4DE",
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flex: 1,
        minWidth: 0,
        cursor: href ? "pointer" : "default",
        transition: href ? "box-shadow 0.15s, border-color 0.15s" : undefined,
      }}
      onMouseEnter={(e) => {
        if (href) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
          (e.currentTarget as HTMLDivElement).style.borderColor = accent;
        }
      }}
      onMouseLeave={(e) => {
        if (href) {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
          (e.currentTarget as HTMLDivElement).style.borderColor = "#E8E4DE";
        }
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: accent + "15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#1F1813", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: "#6E6257", marginTop: 4, fontWeight: 500 }}>
          {label}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", display: "flex", flex: 1, minWidth: 0 }}>
        {inner}
      </Link>
    );
  }

  return inner;
}
