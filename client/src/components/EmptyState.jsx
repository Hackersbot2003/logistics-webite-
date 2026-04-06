/**
 * EmptyState
 *
 * Props:
 *   icon     - emoji or JSX
 *   title    - string
 *   subtitle - string
 *   action   - JSX (optional button)
 */
export default function EmptyState({ icon = "📭", title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "72px 32px", textAlign: "center",
      }}
    >
      <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>{icon}</div>
      {title && (
        <h3 style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 700,
          fontSize: "18px", color: "#2A3347", margin: "0 0 6px",
        }}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p style={{ fontSize: "14px", color: "#1E2535", margin: "0 0 24px", maxWidth: "300px" }}>
          {subtitle}
        </p>
      )}
      {action}
    </div>
  );
}
