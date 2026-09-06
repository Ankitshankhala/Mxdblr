"use client";

/**
 * StatusBadge — colour-coded label for admin status values (dealer status,
 * inquiry/order status, etc.). Maps a status string to a consistent style.
 */
type StatusBadgeProps = {
  status: string;
};

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  // Stock statuses
  IN_STOCK:   { bg: "#E6F3E7", color: "#2E7D32", label: "In Stock" },
  LOW_STOCK:  { bg: "#FEF3D7", color: "#F59E0B", label: "Low Stock" },
  OUT_OF_STOCK: { bg: "#FCE7E7", color: "#DC2626", label: "Out of Stock" },
  // Dealer statuses
  ACTIVE:     { bg: "#E6F3E7", color: "#2E7D32", label: "Active" },
  SUSPENDED:  { bg: "#FEF3D7", color: "#F59E0B", label: "Suspended" },
  BLOCKED:    { bg: "#FCE7E7", color: "#DC2626", label: "Blocked" },
  REJECTED:   { bg: "#F0F0F0", color: "#6E6257", label: "Rejected" },
  PENDING:    { bg: "#EEF0FE", color: "#6366F1", label: "Pending" },
  // Inquiry statuses
  NEW:        { bg: "#FFF3E8", color: "#F47920", label: "New" },
  VIEWED:     { bg: "#EEF0FE", color: "#6366F1", label: "Viewed" },
  RESPONDED:  { bg: "#E6F3E7", color: "#2E7D32", label: "Responded" },
  CLOSED:     { bg: "#F0F0F0", color: "#6E6257", label: "Closed" },
  // Notification statuses
  SENT:       { bg: "#E6F3E7", color: "#2E7D32", label: "Sent" },
  FAILED:     { bg: "#FCE7E7", color: "#DC2626", label: "Failed" },
  // Geo statuses
  ALLOWED:    { bg: "#E6F3E7", color: "#2E7D32", label: "Allowed" },
  BLOCKED_GEO:{ bg: "#FCE7E7", color: "#DC2626", label: "Blocked" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { bg: "#F0F0F0", color: "#6E6257", label: status };
  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        display: "inline-block",
      }}
    >
      {config.label}
    </span>
  );
}
