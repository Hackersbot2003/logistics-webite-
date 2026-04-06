import { useEffect } from "react";

/**
 * ConfirmModal
 *
 * Props:
 *   open       - boolean
 *   title      - string
 *   message    - string
 *   confirmLabel - string (default "Delete")
 *   onConfirm  - () => void
 *   onCancel   - () => void
 *   danger     - boolean (red confirm button)
 */
export default function ConfirmModal({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  danger = true,
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          background: "#0E1117",
          border: "1px solid #1E2535",
          borderRadius: "18px",
          padding: "32px",
          maxWidth: "420px",
          width: "100%",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          animation: "slideUp 0.25s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Icon */}
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: danger ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
          border: `1px solid ${danger ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", marginBottom: "20px",
        }}>
          {danger ? "🗑️" : "⚠️"}
        </div>

        <h3 style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 700,
          fontSize: "18px", color: "#E2E8F0", margin: "0 0 8px",
        }}>
          {title}
        </h3>

        {message && (
          <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 24px", lineHeight: 1.6 }}>
            {message}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "#1E2535", border: "1px solid #2A3347",
              color: "#94A3B8", padding: "10px 20px",
              borderRadius: "10px", cursor: "pointer",
              fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500, transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.target.style.borderColor = "#3D4F6B"; e.target.style.color = "#E2E8F0"; }}
            onMouseLeave={(e) => { e.target.style.borderColor = "#2A3347"; e.target.style.color = "#94A3B8"; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: danger ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
              border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
              color: danger ? "#EF4444" : "#F59E0B",
              padding: "10px 20px", borderRadius: "10px",
              cursor: "pointer", fontSize: "14px",
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.target.style.background = danger ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"; }}
            onMouseLeave={(e) => { e.target.style.background = danger ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
