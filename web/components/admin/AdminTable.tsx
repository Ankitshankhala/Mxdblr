"use client";

/**
 * AdminTable — reusable data table for the admin panel: column config, optional
 * sorting, and empty/loading states. Shared across the admin list pages.
 */
import { ReactNode, useState } from "react";

type Column<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

type AdminTableProps<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
};

export default function AdminTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
}: AdminTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp =
          typeof av === "string" && typeof bv === "string"
            ? av.localeCompare(bv)
            : typeof av === "number" && typeof bv === "number"
            ? av - bv
            : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : data;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          color: "#1A1A2E",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "2px solid #E8E4DE" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#6B6B7D",
                  cursor: col.sortable ? "pointer" : "default",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              style={{
                borderBottom: "1px solid #F0EDEA",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAF9";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
              }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "32px 12px", textAlign: "center", color: "#6B6B7D" }}
              >
                No records found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
