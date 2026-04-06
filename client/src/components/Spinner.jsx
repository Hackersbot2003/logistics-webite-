/**
 * Spinner - full-page or inline loading indicator
 *
 * Props:
 *   fullPage  - boolean (centers in viewport)
 *   size      - number (px, default 36)
 *   color     - string (default amber)
 */
export default function Spinner({ fullPage = false, size = 36, color = "#F59E0B" }) {
  const spinner = (
    <>
      <div
        style={{
          width: size,
          height: size,
          border: `${Math.max(2, size / 12)}px solid #1E2535`,
          borderTopColor: color,
          borderRadius: "50%",
          animation: "ds-spin 0.75s linear infinite",
        }}
      />
      <style>{`@keyframes ds-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );

  if (fullPage) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "#080A0F",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999,
        }}
      >
        {spinner}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px" }}>
      {spinner}
    </div>
  );
}
