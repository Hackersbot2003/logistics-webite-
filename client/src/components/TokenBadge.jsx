/**
 * TokenBadge
 * Displays a DRV-XXXXXXXX token number with consistent amber styling.
 *
 * Props:
 *   tokenNo  - string
 *   size     - "sm" | "md" | "lg"
 */
export default function TokenBadge({ tokenNo, size = "md" }) {
  const sizes = {
    sm: { fontSize: "10px", padding: "2px 8px", borderRadius: "5px" },
    md: { fontSize: "12px", padding: "3px 10px", borderRadius: "6px" },
    lg: { fontSize: "14px", padding: "5px 14px", borderRadius: "8px" },
  };

  return (
    <span
      style={{
        background: "rgba(245,158,11,0.1)",
        border: "1px solid rgba(245,158,11,0.25)",
        color: "#FBBF24",
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        letterSpacing: "0.05em",
        display: "inline-block",
        ...sizes[size],
      }}
    >
      {tokenNo}
    </span>
  );
}
